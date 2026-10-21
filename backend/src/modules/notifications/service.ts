import { getSupabaseAdmin } from '../../db/client.js';
import type { AuthUser } from '../../middleware/auth.js';
import type { ListNotificationsQuery, MarkNotificationsReadInput } from './schema.js';

export async function listNotifications(user: AuthUser, query: ListNotificationsQuery) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('notifications')
    .select(`
      id,
      user_id,
      report_id,
      type,
      title,
      body,
      read,
      read_at,
      created_at
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(query.offset, query.offset + query.limit - 1);

  if (error) {
    throw new Error(`Failed to list notifications: ${error.message}`);
  }

  return data ?? [];
}

export async function markNotificationsRead(user: AuthUser, input: MarkNotificationsReadInput) {
  const supabase = getSupabaseAdmin();

  let updateQuery = supabase
    .from('notifications')
    .update({
      read: true,
      read_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);

  if (input.ids && input.ids.length > 0) {
    updateQuery = updateQuery.in('id', input.ids);
  }

  const { error } = await updateQuery;

  if (error) {
    throw new Error(`Failed to mark notifications as read: ${error.message}`);
  }

  return { success: true };
}
