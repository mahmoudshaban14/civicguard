-- RLS does not protect against TRUNCATE, and clients never need these privileges
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;