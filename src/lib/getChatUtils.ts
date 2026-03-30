import { supabase } from './supabase';

/**
 * หาหรือสร้างแชทระหว่าง 2 คน (DM)
 */
export async function getOrCreateChat(currentUserId: string, targetUserId: string): Promise<string | null> {
  try {
    // 1. หาแชทที่มี User ทั้งคู่เป็นสมาชิก (DM ปกติจะมีแค่ 2 คน)
    // เราหา chat_id ที่เรา (currentUserId) อยู่ก่อน
    const { data: myChats } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('user_id', currentUserId);

    if (myChats && myChats.length > 0) {
      const myChatIds = myChats.map(c => c.chat_id);

      // เช็กว่าในบรรดาแชทของฉัน มีแชทไหนที่มี targetUserId อยู่ด้วยไหม (และต้องเป็น DM)
      const { data: existingParticipant } = await supabase
        .from('chat_participants')
        .select('chat_id, chats!inner(is_group)')
        .in('chat_id', myChatIds)
        .eq('user_id', targetUserId)
        .eq('chats.is_group', false) // มั่นใจว่าเป็นแชทส่วนตัว ไม่ใช่กลุ่ม
        .maybeSingle();

      if (existingParticipant) {
        return existingParticipant.chat_id;
      }
    }

    // 2. ถ้าไม่เจอ ให้สร้างแชทใหม่
    const { data: newChat, error: chatError } = await supabase
      .from('chats')
      .insert({ is_group: false })
      .select()
      .single();

    if (chatError || !newChat) throw new Error('Failed to create chat');

    // เพิ่มทั้งคู่เข้าไปในแชทใหม่
    const { error: participantsError } = await supabase
      .from('chat_participants')
      .insert([
        { chat_id: newChat.id, user_id: currentUserId },
        { chat_id: newChat.id, user_id: targetUserId }
      ]);

    if (participantsError) throw new Error('Failed to add participants');

    return newChat.id;

  } catch (error) {
    console.error('Error in getOrCreateChat:', error);
    return null;
  }
}
