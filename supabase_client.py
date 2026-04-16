import os

from supabase import create_client


# ADD BELOW THIS LINE - Supabase client helpers
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")


def get_supabase():
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return None
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def insert_booking(payload):
    client = get_supabase()
    if client:
        client.table("bookings").insert(payload).execute()


def insert_admin(payload):
    client = get_supabase()
    if client:
        client.table("admins").upsert(payload, on_conflict="sqlite_id").execute()


def update_admin(sqlite_id, payload):
    client = get_supabase()
    if client:
        client.table("admins").update(payload).eq("sqlite_id", sqlite_id).execute()


def delete_admin(sqlite_id):
    client = get_supabase()
    if client:
        client.table("admins").delete().eq("sqlite_id", sqlite_id).execute()


def fetch_bookings():
    client = get_supabase()
    if client:
        return client.table("bookings").select("*").execute()
    return None
