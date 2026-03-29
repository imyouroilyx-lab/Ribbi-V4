import { supabase } from './supabase';

/**
 * สร้างการแจ้งเตือนใหม่ (อิงตามโครงสร้างคอลัมน์จริงใน DB)
 */
export async function createNotification(
  receiverId: string,
  senderId: string,
  type: 'like' | 'comment' | 'reply' | 'comment_like' | 'friend_request' | 'friend_accept' | 'post_on_profile' | 'tag_post' | 'tag_comment' | 'message',
  postId?: string,
  commentId?: string
) {
  try {
    const { error } = await supabase.from('notifications').insert({
      receiver_id: receiverId,
      sender_id: senderId,
      type,
      post_id: postId,
      comment_id: commentId,
      is_read: false,
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error creating notification:', error);
    return false;
  }
}

export async function notifyProfilePost(profileOwnerId: string, postAuthorId: string, postId: string) {
  if (profileOwnerId === postAuthorId) return;
  await createNotification(profileOwnerId, postAuthorId, 'post_on_profile', postId);
}

export async function notifyFriendRequest(receiverId: string, senderId: string) {
  await createNotification(receiverId, senderId, 'friend_request');
}

export async function notifyFriendAccept(receiverId: string, senderId: string) {
  await createNotification(receiverId, senderId, 'friend_accept');
}

export async function notifyTag(taggedUserId: string, taggerId: string, postId: string, commentId?: string) {
  if (taggedUserId === taggerId) return;
  await createNotification(taggedUserId, taggerId, commentId ? 'tag_comment' : 'tag_post', postId, commentId);
}
