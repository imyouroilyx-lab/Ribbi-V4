import { supabase } from './supabase';

/**
 * หาหรือสร้างแชทระหว่าง 2 คน
 * ใช้ได้ทั้งหน้าแชต, โปรไฟล์, ปุ่มส่งข้อความ
 * @param currentUserId - ID ของผู้ใช้ปัจจุบัน
 * @param targetUserId - ID ของคนที่ต้องการคุยด้วย
 * @returns chatId ของแชทที่มีอยู่หรือสร้างใหม่
 */
export async function getOrCreateChat(currentUserId: string, targetUserId: string): Promise<string | null> {
  try {
    // 1. หาแชทที่มีอยู่แล้ว
    const { data: currentUserChats } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('user_id', currentUserId);

    const { data: targetUserChats } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('user_id', targetUserId);

    if (!currentUserChats || !targetUserChats) {
      throw new Error('Failed to fetch chats');
    }

    // หา chat_id ที่ซ้ำกัน (แชทที่มีทั้ง 2 คน)
    const currentChatIds = currentUserChats.map(c => c.chat_id);
    const targetChatIds = targetUserChats.map(c => c.chat_id);
    const existingChatId = currentChatIds.find(id => targetChatIds.includes(id));

    if (existingChatId) {
      console.log('✅ Found existing chat:', existingChatId);
      return existingChatId;
    }

    // 2. ไม่มีแชท - สร้างใหม่
    console.log('🆕 Creating new chat');
    
    const { data: newChat, error: chatError } = await supabase
      .from('chats')
      .insert({})
      .select()
      .single();

    if (chatError || !newChat) {
      throw new Error('Failed to create chat');
    }

    // เพิ่ม participants
    const { error: participantsError } = await supabase
      .from('chat_participants')
      .insert([
        { chat_id: newChat.id, user_id: currentUserId },
        { chat_id: newChat.id, user_id: targetUserId }
      ]);

    if (participantsError) {
      throw new Error('Failed to add participants');
    }

    console.log('✅ Created new chat:', newChat.id);
    return newChat.id;

  } catch (error) {
    console.error('Error in getOrCreateChat:', error);
    return null;
  }
}