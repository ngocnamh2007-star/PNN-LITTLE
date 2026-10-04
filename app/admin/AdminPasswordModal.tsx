"use client";
import { useEffect, useState } from "react";
export default function AdminPasswordModal(){
 const [open,setOpen]=useState(false),[current,setCurrent]=useState(""),[password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[show,setShow]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{const openPopup=()=>{setMessage("");setOpen(true);};window.addEventListener("admin-open-password",openPopup);return()=>window.removeEventListener("admin-open-password",openPopup);},[]);
 async function change(){if(password!==confirm){setMessage("Mật khẩu mới chưa khớp");return;}const r=await fetch("/api/admin/password",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({currentPassword:current,newPassword:password})});const d=await r.json();setMessage(r.ok?"Đã đổi mật khẩu thành công":(d.error||"Không thể đổi mật khẩu"));if(r.ok){setCurrent("");setPassword("");setConfirm("");}}
 const input=(label:string,value:string,set:(v:string)=>void)=><label className="admin-field"><span>{label}</span><div className="password-input-wrap"><input type={show?"text":"password"} value={value} onChange={e=>set(e.target.value)}/><button type="button" onClick={()=>setShow(!show)}>{show?"◉":"◌"}</button></div></label>;
 if(!open)return null;
 return <div className="password-modal-backdrop" onClick={()=>setOpen(false)}><section className="admin-panel password-modal" onClick={e=>e.stopPropagation()}><button type="button" className="password-modal-close" onClick={()=>setOpen(false)} aria-label="Đóng">×</button><h2>Đổi mật khẩu</h2><p>Đổi mật khẩu đăng nhập trang quản lý món quà.</p>{input("Mật khẩu hiện tại",current,setCurrent)}{input("Mật khẩu mới",password,setPassword)}{input("Nhập lại mật khẩu mới",confirm,setConfirm)}<button className="save-button" type="button" onClick={()=>void change()}>Đổi mật khẩu</button>{message&&<p className="save-status">{message}</p>}</section></div>;
}
