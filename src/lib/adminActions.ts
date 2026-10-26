'use server';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Admin Server Actions
 *
 * Server Action ทุกตัวเรียกได้โดยตรงจากภายนอก (ไม่ต้องผ่านหน้า /management)
 * ดังนั้นทุกฟังก์ชันในไฟล์นี้ต้องยืนยันตัวตนผู้เรียกฝั่งเซิร์ฟเวอร์ก่อนเสมอ
 *
 * ต้องตั้งค่า Environment Variables (ห้ามขึ้นต้นด้วย NEXT_PUBLIC_):
 *   SUPABASE_SERVICE_ROLE_KEY = service role key จาก Supabase
 *   ADMIN_USER_IDS            = user id ของแอดมิน คั่นด้วยจุลภาค เช่น "uuid-1,uuid-2"
 */

type ActionResult = { success: boolean; message: string };

let adminClient: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient {
  if (!adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      throw new Error('Server is missing SUPABASE_SERVICE_ROLE_KEY');
    }
    adminClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}

function getAdminIds(): Set<string> {
  return new Set(
    (process.env.ADMIN_USER_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

/**
 * ตรวจ access token ของผู้เรียกกับ Supabase Auth แล้วเช็กว่าอยู่ในรายชื่อแอดมิน
 * คืนค่า user id ของแอดมิน หรือ throw ถ้าไม่มีสิทธิ์
 */
async function requireAdmin(accessToken: string): Promise<string> {
  if (!accessToken || typeof accessToken !== 'string') {
    throw new Error('ไม่ได้เข้าสู่ระบบ');
  }

  const { data, error } = await getAdminClient().auth.getUser(accessToken);
  if (error || !data.user) {
    throw new Error('เซสชันไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่');
  }

  if (!getAdminIds().has(data.user.id)) {
    throw new Error('คุณไม่มีสิทธิ์เข้าถึงส่วนนี้');
  }

  return data.user.id;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

function fail(error: unknown): ActionResult {
  const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
  return { success: false, message };
}

/**
 * 0. เช็กว่าผู้ใช้ปัจจุบันเป็นแอดมินหรือไม่ (ใช้ตอนเปิดหน้า /management)
 */
export async function checkIsAdmin(accessToken: string): Promise<boolean> {
  try {
    await requireAdmin(accessToken);
    return true;
  } catch {
    return false;
  }
}

export type AdminUserRow = {
  id: string;
  username: string;
  display_name: string;
  profile_img_url: string | null;
  cover_img_url: string | null;
  created_at: string;
  email: string | null;
};

type ListUsersResult =
  | { success: true; users: AdminUserRow[]; total: number }
  | { success: false; message: string; users: []; total: 0 };

/**
 * หา user id จากอีเมลใน Supabase Auth (อีเมลไม่ได้เก็บในตาราง users สาธารณะแล้ว)
 */
async function findUserIdsByEmail(term: string): Promise<string[]> {
  const ids: string[] = [];
  const needle = term.toLowerCase();
  const perPage = 1000;

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await getAdminClient().auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email && u.email.toLowerCase().includes(needle)) ids.push(u.id);
    }
    if (data.users.length < perPage || ids.length >= 100) break;
  }

  return ids.slice(0, 100);
}

/**
 * 0.1 ดึงรายชื่อสมาชิกพร้อมอีเมล (เฉพาะแอดมิน)
 */
export async function adminListUsers(
  accessToken: string,
  page: number,
  perPage: number,
  search: string
): Promise<ListUsersResult> {
  try {
    await requireAdmin(accessToken);

    const safePage = Math.max(1, Math.floor(Number(page) || 1));
    const safePerPage = Math.min(100, Math.max(1, Math.floor(Number(perPage) || 20)));
    const from = (safePage - 1) * safePerPage;
    const to = from + safePerPage - 1;

    // ตัดอักขระที่มีความหมายพิเศษในตัวกรองของ Supabase ออก
    const term = (typeof search === 'string' ? search : '').replace(/[,()*%\\]/g, '').trim();

    let query = getAdminClient()
      .from('users')
      .select('id, username, display_name, profile_img_url, cover_img_url, created_at', {
        count: 'exact',
      });

    if (term) {
      const filters = [`display_name.ilike.%${term}%`, `username.ilike.%${term}%`];
      const emailIds = await findUserIdsByEmail(term);
      if (emailIds.length > 0) filters.push(`id.in.(${emailIds.join(',')})`);
      query = query.or(filters.join(','));
    }

    const { data, error, count } = await query
      .order('display_name', { ascending: true })
      .range(from, to);
    if (error) throw error;

    const rows = data || [];
    const emails = await Promise.all(
      rows.map(async (row) => {
        const { data: authUser } = await getAdminClient().auth.admin.getUserById(row.id);
        return authUser?.user?.email ?? null;
      })
    );

    return {
      success: true,
      users: rows.map((row, i) => ({ ...row, email: emails[i] })),
      total: count || 0,
    };
  } catch (error) {
    console.error('Admin API Error (List Users):', error);
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
    return { success: false, message, users: [], total: 0 };
  }
}

/**
 * 1. เปลี่ยนรหัสผ่าน (Force Reset)
 */
export async function forceResetUserPassword(
  accessToken: string,
  userId: string,
  newPassword: string
): Promise<ActionResult> {
  try {
    await requireAdmin(accessToken);
    if (!isUuid(userId)) throw new Error('user id ไม่ถูกต้อง');
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    }

    const { error } = await getAdminClient().auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (error) throw error;

    return { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ!' };
  } catch (error) {
    console.error('Admin API Error (Reset Password):', error);
    return fail(error);
  }
}

/**
 * 2. แก้ไขโปรไฟล์สมาชิก (รวมรูปโปรไฟล์และรูปปก)
 */
export async function updateUserProfile(
  accessToken: string,
  userId: string,
  displayName: string,
  username: string,
  profileImgUrl?: string,
  coverImgUrl?: string
): Promise<ActionResult> {
  try {
    await requireAdmin(accessToken);
    if (!isUuid(userId)) throw new Error('user id ไม่ถูกต้อง');

    const name = typeof displayName === 'string' ? displayName.trim() : '';
    const handle = typeof username === 'string' ? username.trim() : '';
    if (!name || name.length > 100) throw new Error('ชื่อที่แสดงต้องมี 1-100 ตัวอักษร');
    if (!handle || handle.length > 50) throw new Error('username ต้องมี 1-50 ตัวอักษร');

    const { error } = await getAdminClient()
      .from('users')
      .update({
        display_name: name,
        username: handle,
        profile_img_url: profileImgUrl || null,
        cover_img_url: coverImgUrl || null,
      })
      .eq('id', userId);
    if (error) throw error;

    return { success: true, message: 'อัปเดตข้อมูลสำเร็จ!' };
  } catch (error) {
    console.error('Admin API Error (Update Profile):', error);
    return fail(error);
  }
}

/**
 * 3. ลบผู้ใช้
 */
export async function deleteUserAccount(
  accessToken: string,
  userId: string
): Promise<ActionResult> {
  try {
    const adminId = await requireAdmin(accessToken);
    if (!isUuid(userId)) throw new Error('user id ไม่ถูกต้อง');
    if (userId === adminId) throw new Error('ไม่สามารถลบบัญชีของตัวเองได้');

    const { error } = await getAdminClient().auth.admin.deleteUser(userId);
    if (error) throw error;

    return { success: true, message: 'ลบผู้ใช้สำเร็จ!' };
  } catch (error) {
    console.error('Admin API Error (Delete User):', error);
    return fail(error);
  }
}
