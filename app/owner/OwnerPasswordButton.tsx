"use client";
import { useState } from "react";
export default function OwnerPasswordButton(){
 const [current,setCurrent]=useState(""),[password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[show,setShow]=useState(false),[message,setMessage]=useState("");
 async function change(){if(password!==confirm){setMessage("Mật khẩu mới chưa khớp");return;}const r=await fetch("/api/owner/password",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({currentPassword:current,password})});const d=await r.json();setMessage(r.ok?"Đã đổi mật khẩu quản trị":(d.error||"Không thể đổi mật khẩu"));if(r.ok){setCurrent("");setPassword("");setConfirm("");}}
 const input=(label:string,value:string,set:(v:string)=>void)=><label><span>{label}</span><div className="password-input-wrap"><input type={show?"text":"password"} value={value} onChange={e=>set(e.target.value)}/><button type="button" onClick={()=>setShow(!show)} aria-label="Hiện hoặc ẩn mật khẩu">👁</button></div></label>;
 return <section className="admin-panel owner-password-panel"><h2>Đổi mật khẩu quản trị</h2><p>Đổi mật khẩu dùng để đăng nhập trang quản trị hệ thống.</p>{input("Mật khẩu hiện tại",current,setCurrent)}{input("Mật khẩu mới",password,setPassword)}{input("Nhập lại mật khẩu mới",confirm,setConfirm)}<button className="save-button" type="button" onClick={()=>void change()}>Đổi mật khẩu</button>{message&&<p className="save-status">{message}</p>}</section>;
}
