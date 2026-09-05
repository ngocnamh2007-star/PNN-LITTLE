"use client";
import { useEffect, useState } from "react";
export default function OwnerAccountSearch(){
 const [query,setQuery]=useState("");
 useEffect(()=>{const apply=()=>{const q=query.trim().toLowerCase();document.querySelectorAll<HTMLElement>(".owner-account").forEach(row=>{row.style.display=!q||row.textContent?.toLowerCase().includes(q)?"":"none";});};apply();const observer=new MutationObserver(apply);const target=document.querySelector(".owner-accounts");if(target)observer.observe(target,{childList:true,subtree:true});return()=>observer.disconnect();},[query]);
 return <label className="owner-account-search"><span>Tìm tài khoản bằng email hoặc số điện thoại</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nhập email hoặc số điện thoại..."/></label>;
}
