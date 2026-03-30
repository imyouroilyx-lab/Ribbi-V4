import { supabase } from './supabase';

/**
 * สร้างการแจ้งเตือนลง Database
 */
export async function createNotification(
  receiverId: string,
  senderId: string,
  type: 'post' | 'friend_request' | 'friend_accept' | 'tag' | 'message',
  linkUrl?: string,
  content?: string
) {
  if (receiverId === senderId) return false; // ป้องกันการส่งหาตัวเอง

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
 * แจ้งเตือนเมื่อมีคนมาโพสต์หน้าโปรไฟล์
 */
export async function notifyProfilePost(profileOwnerId: string, postAuthorId: string, postId: string) {
  return createNotification(
    profileOwnerId,
    postAuthorId,
    'post',
    `/profile/${profileOwnerId}`, // หรือชี้ไปที่โพสต์โดยตรง
    `โพสต์ข้อความบนหน้าโปรไฟล์ของคุณ`
  );
}

/**
 * แจ้งเตือนเมื่อรับเพื่อน
 */
export async function notifyFriendAccept(receiverId: string, senderId: string) {
  const { data: sender } = await supabase
    .from('users')
    .select('display_name, username')
    .eq('id', senderId)
    .single();

  return createNotification(
    receiverId,
    senderId,
    'friend_accept',
    `/profile/${sender?.username}`,
    `ตอบรับคำขอเป็นเพื่อนของคุณ`
  );
}

/**
 * แจ้งเตือนเมื่อถูกแท็ก
 */
export async function notifyTag(taggedUserId: string, taggerId: string, postLink: string) {
  return createNotification(
    taggedUserId,
    taggerId,
    'tag',
    postLink,
    `แท็กคุณในโพสต์`
  );
}

/**
 * แจ้งเตือนข้อความใหม่ (ถ้าแอปต้องการบันทึกลง Table notifications ด้วย)
 */
export async function notifyNewMessage(receiverId: string, senderId: string, chatId: string) {
  return createNotification(
    receiverId,
    senderId,
    'message',
    `/messages?chat=${chatId}`,
    `ส่งข้อความถึงคุณ`
  );
}
