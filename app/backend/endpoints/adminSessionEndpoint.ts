import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { clearAdminSessionCookie, createAdminSessionCookie, verifyAdminAuth } from "../../utils/adminAuth";

function envOf(context?: any): Record<string,string|undefined> {
  return ((context as any)?.cloudflare?.env || process.env || {}) as Record<string,string|undefined>;
}
function safeEqual(a:string,b:string):boolean {
  if (!a || !b || a.length!==b.length) return false;
  let diff=0; for(let i=0;i<a.length;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
function validOrigin(request:Request):boolean {
  const origin=request.headers.get("origin");
  return !!origin && origin===new URL(request.url).origin;
}
export async function handleAdminSessionLoader({request,context}:LoaderFunctionArgs) {
  const auth=await verifyAdminAuth(request,context);
  return Response.json({authenticated:auth.authorized},{headers:{"Cache-Control":"no-store"}});
}
export async function handleAdminSessionAction({request,context}:ActionFunctionArgs) {
  if (!validOrigin(request)) return Response.json({success:false,error:"Invalid request origin"},{status:403});
  const secure=new URL(request.url).protocol==="https:";
  if (request.method.toUpperCase()==="DELETE") {
    return new Response(JSON.stringify({success:true}),{status:200,headers:{"Content-Type":"application/json","Cache-Control":"no-store","Set-Cookie":clearAdminSessionCookie(request)}});
  }
  if (request.method.toUpperCase()!=="POST") return Response.json({success:false,error:"Method not allowed"},{status:405,headers:{Allow:"POST, DELETE"}});
  const env=envOf(context);
  const expectedUser=String(env.ADMIN_USERNAME || "admin");
  const expectedPass=String(env.ADMIN_PASSWORD || "");
  if (expectedPass.length < 16 || String(env.ADMIN_SESSION_SECRET || "").length < 32) {
    return Response.json({success:false,error:"Admin secrets are not configured. Set ADMIN_PASSWORD (16+ characters) and ADMIN_SESSION_SECRET (32+ characters)."},{status:503});
  }
  let body:any;
  try { body=await request.json(); } catch { return Response.json({success:false,error:"Invalid JSON"},{status:400}); }
  if (!safeEqual(String(body.username || ""),expectedUser) || !safeEqual(String(body.password || ""),expectedPass)) {
    return Response.json({success:false,error:"Invalid username or password"},{status:401,headers:{"Cache-Control":"no-store"}});
  }
  const cookie=await createAdminSessionCookie(request,context);
  if (!cookie) return Response.json({success:false,error:"Unable to create admin session"},{status:503});
  return new Response(JSON.stringify({success:true}),{status:200,headers:{"Content-Type":"application/json","Cache-Control":"no-store","Set-Cookie":cookie}});
}
