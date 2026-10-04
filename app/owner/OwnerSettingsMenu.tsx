"use client";
import { useState } from "react";
export default function OwnerSettingsMenu(){
 const [open,setOpen]=useState(false);
 async function logout(){await fetch("/api/owner/logout",{method:"POST"});window.location.href="/owner/login";}
 return <div className="owner-settings-menu-wrap"><button type="button" className="settings-button" aria-label="Cài đặt" onClick={()=>setOpen(v=>!v)}>⚙</button>{open&&<div className="settings-menu" role="dialog" aria-label="Cài đặt"><div className="settings-menu-header"><strong>Cài đặt</strong><button type="button" className="settings-menu-close" aria-label="Đóng cài đặt" onClick={()=>setOpen(false)}>×</button></div><button type="button" onClick={()=>{setOpen(false);window.dispatchEvent(new Event("owner-open-password"));}}>Đổi mật khẩu</button><button type="button" onClick={()=>{setOpen(false);window.dispatchEvent(new Event("owner-open-sessions"));}}>Lịch sử đăng nhập</button><button type="button" onClick={()=>void logout()}>Đăng xuất</button></div>}</div>;
}
