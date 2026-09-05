"use client";
import { useState } from "react";
export default function OwnerPasswordButton(){
 const [message,setMessage]=useState("");
 async function change(){const password=prompt("Nhập mật khẩu quản trị mới (ít nhất 8 ký tự):");if(!password)return;const r=await fetch("/api/owner/password",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({password})});setMessage(r.ok?"Đã đổi mật khẩu quản trị":"Mật khẩu cần ít nhất 8 ký tự");}
 return <span className="owner-password-control"><button type="button" onClick={()=>void change()}>Đổi mật khẩu</button>{message&&<small>{message}</small>}</span>;
}
