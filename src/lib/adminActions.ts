'use server';

import { createClient } from '@supabase/supabase-js';

// สร้าง Admin Client ด้วย Service Role Key (ข้ามกฎ RLS ทั้งหมด)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// 1. ฟังก์ชันเปลี่ยนรหัสผ่าน
export async function forceResetUserPassword(userId: string, newPassword: string) {
  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (error) throw error;
    return { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ!' };
  } catch (error: any) {
    console.error('Admin API Error (Reset Password):', error);
    return { success: false, message: error.message };
  }
}

// 2. ฟังก์ชันแก้ไขโปรไฟล์ (ใช้ Admin สั่งแก้ เพื่อป้องกันปัญหาติดสิทธิ์ RLS)
export async function updateUserProfile(userId: string, displayName: string, username: string) {
  try {
    const { error } = await supabaseAdmin
      .from('users')
      .update({ 
        display_name: displayName,
        username: username 
      })
      .eq('id', userId);

    if (error) throw error;
    return { success: true, message: 'อัปเดตข้อมูลสำเร็จ!' };
  } catch (error: any) {
    console.error('Admin API Error (Update Profile):', error);
    return { success: false, message: error.message };
  }
}

// 3. ฟังก์ชันลบผู้ใช้ (ลบออกจาก Auth แล้วฐานข้อมูลจะลบตามถ้าระบุ Cascade ไว้)
export async function deleteUserAccount(userId: string) {
  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) throw error;
    return { success: true, message: 'ลบผู้ใช้สำเร็จ!' };
  } catch (error: any) {
    console.error('Admin API Error (Delete User):', error);
    return { success: false, message: error.message };
  }
}