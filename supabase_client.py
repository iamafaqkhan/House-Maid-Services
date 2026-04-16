import os
import logging

from supabase import create_client


# ADD BELOW THIS LINE - Supabase client helpers
logger = logging.getLogger(__name__)


def get_supabase():
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_anon_key = os.environ.get("SUPABASE_ANON_KEY")

    if not supabase_url or not supabase_anon_key:
        logger.warning(
            "Supabase is not configured. Missing SUPABASE_URL and/or SUPABASE_ANON_KEY."
        )
        return None
    return create_client(supabase_url, supabase_anon_key)


def insert_booking(payload):
    client = get_supabase()
    if client:
        res = client.table("bookings").insert(payload).execute()
        err = getattr(res, "error", None)
        if err:
            logger.error("Supabase insert_booking failed: %s", err)


def insert_admin(payload):
    client = get_supabase()
    if client:
        res = client.table("admins").upsert(payload, on_conflict="sqlite_id").execute()
        err = getattr(res, "error", None)
        if err:
            logger.error("Supabase insert_admin failed: %s", err)


def update_admin(sqlite_id, payload):
    client = get_supabase()
    if client:
        res = client.table("admins").update(payload).eq("sqlite_id", sqlite_id).execute()
        err = getattr(res, "error", None)
        if err:
            logger.error("Supabase update_admin failed: %s", err)


def delete_admin(sqlite_id):
    client = get_supabase()
    if client:
        res = client.table("admins").delete().eq("sqlite_id", sqlite_id).execute()
        err = getattr(res, "error", None)
        if err:
            logger.error("Supabase delete_admin failed: %s", err)


def fetch_bookings():
    client = get_supabase()
    if client:
        res = client.table("bookings").select("*").execute()
        err = getattr(res, "error", None)
        if err:
            logger.error("Supabase fetch_bookings failed: %s", err)
        return res
    return None
