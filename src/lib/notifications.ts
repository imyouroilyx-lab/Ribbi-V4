import { supabase } from './supabase';

/**
 * สร้างการแจ้งเตือนใหม่
 */
export async function createNotification(
  receiverId: string,
  senderId: string,
  type: 'post' | 'friend_request' | 'friend_accept' | 'tag' | 'message',
  linkUrl?: string,
  content?: string
) {
  try {
    const { error } = await supabase.from('notifications').insert({
      receiver_id: receiverId,
      sender_id: senderId,
      type,
      link_url: linkUrl,
      content,
      is_read: false,
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error creating notification:', error);
    return false;
  }
}

/**
 * สร้างการแจ้งเตือนเมื่อมีคนโพสต์บนหน้าโปรไฟล์
 */
export async function notifyProfilePost(
  profileOwnerId: string,
  postAuthorId: string,
  postId: string
) {
  if (profileOwnerId === postAuthorId) return; // ไม่แจ้งเตือนตัวเอง

  const { data: author } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', postAuthorId)
    .single();

  await createNotification(
    profileOwnerId,
    postAuthorId,
    'post',
    `/profile/${profileOwnerId}`,
    `โพสต์ข้อความบนหน้าโปรไฟล์ของคุณ`
  );
}

/**
 * สร้างการแจ้งเตือนเมื่อมีคนส่งคำขอเป็นเพื่อน
 */
export async function notifyFriendRequest(receiverId: string, senderId: string) {
  // 🛑 ไม่ต้องสร้างการแจ้งเตือนลงฐานข้อมูลแล้ว 
  // ให้ระบบไปเช็กและขึ้น Badge ที่หน้า Friends โดยตรงแทน
  return; 
}

/**
 * สร้างการแจ้งเตือนเมื่อมีคนรับคำขอเป็นเพื่อน
 */
export async function notifyFriendAccept(receiverId: string, senderId: string) {
  const { data: sender } = await supabase
    .from('users')
    .select('display_name, username')
    .eq('id', senderId)
    .single();

  await createNotification(
    receiverId,
    senderId,
    'friend_accept',
    `/profile/${sender?.username}`,
    `ตอบรับคำขอเป็นเพื่อนของคุณ`
  );
}

/**
 * สร้างการแจ้งเตือนเมื่อถูกแท็กในโพสต์
 */
export async function notifyTag(
  taggedUserId: string,
  taggerId: string,
  postId: string,
  postLink: string
) {
  if (taggedUserId === taggerId) return;

  await createNotification(
    taggedUserId,
    taggerId,
    'tag',
    postLink,
    `แท็กคุณในโพสต์`
  );
}

/**
 * สร้างการแจ้งเตือนเมื่อมีข้อความใหม่
 */
export async function notifyNewMessage(
  receiverId: string,
  senderId: string,
  roomId: string
) {
  if (receiverId === senderId) return;

  const { data: sender } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', senderId)
    .single();

  await createNotification(
    receiverId,
    senderId,
    'message',
    `/messages?room=${roomId}`,
    `ส่งข้อความถึงคุณ`
  );
}
