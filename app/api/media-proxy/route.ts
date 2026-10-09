import { GET as getMedia, HEAD as headMedia } from "@/lib/media-proxy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = getMedia;
export const HEAD = headMedia;
