import { useState, useEffect } from "react";
import { G } from "./constants.js";

export const IB={width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #DDE8DD",fontSize:13,color:"#1A2B1A",background:"#fff",outline:"none",fontFamily:"Inter,sans-serif",boxSizing:"border-box",transition:"border-color .15s"};

export function Av({s="?",size=32,color=G.green}){
  return <div style={{width:size,height:size,borderRadius:"50%",background:color,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:size*.36,flexShrink:0,userSelect:"none"}}>{s}</div>;
}
export function Chip({color,bg,children,style:sx={}}){
  return <span style={{display:"inline-flex",alignItems:"center",gap:3,background:bg,color,border:"1px solid "+color+"30",borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:700,whiteSpace:"nowrap",...sx}}>{children}</span>;
}
export function Toast({msg,onDone}){
  useEffect(()=>{if(!msg)return;const t=setTimeout(onDone,4500);return()=>clearTimeout(t);},[msg]);
  if(!msg)return null;
  return <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:G.greenDark,color:"#fff",borderRadius:12,padding:"12px 24px",fontSize:14,fontWeight:600,zIndex:9999,boxShadow:"0 8px 24px rgba(0,0,0,.22)",animation:"su .2s ease",maxWidth:460,textAlign:"center"}}>{msg}</div>;
}
export function Inp({style:sx,...p}){
  const[f,sf]=useState(false);
  return <input {...p} onFocus={()=>sf(true)} onBlur={()=>sf(false)} style={{...IB,borderColor:f?"#4CAF50":"#DDE8DD",...sx}}/>;
}
export function Sel({children,style:sx,...p}){
  return <select {...p} style={{...IB,paddingRight:28,...sx}}>{children}</select>;
}
export function Txa({style:sx,...p}){
  const[f,sf]=useState(false);
  return <textarea {...p} onFocus={()=>sf(true)} onBlur={()=>sf(false)} style={{...IB,minHeight:72,resize:"vertical",borderColor:f?"#4CAF50":"#DDE8DD",...sx}}/>;
}
export function Fld({label,required,hint,children}){
  return <div style={{marginBottom:12}}>
    <label style={{display:"block",fontSize:11,fontWeight:700,color:G.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}{required&&<span style={{color:G.red}}> *</span>}</label>
    {children}
    {hint&&<div style={{fontSize:10,color:G.light,marginTop:3}}>{hint}</div>}
  </div>;
}
export function Btn({children,variant="primary",onClick,disabled,style:sx={},size="md",title}){
  const pad={sm:"5px 11px",md:"9px 18px",lg:"12px 28px"}[size];
  const vars={
    primary:{background:G.green,color:"#fff",border:"none"},
    secondary:{background:"none",color:G.muted,border:"1.5px solid #DDE8DD"},
    danger:{background:G.red,color:"#fff",border:"none"},
    ghost:{background:"none",color:G.greenDark,border:"1.5px solid "+G.green},
    warn:{background:G.orange,color:"#fff",border:"none"},
  };
  return <button title={title} onClick={onClick} disabled={disabled} style={{padding:pad,borderRadius:8,fontFamily:"Inter,sans-serif",fontSize:13,fontWeight:700,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.55:1,transition:"opacity .15s,transform .1s",...vars[variant],...sx}}>{children}</button>;
}
export function Modal({open,onClose,title,width=700,children,footer}){
  useEffect(()=>{
    if(!open)return;
    const h=e=>e.key==="Escape"&&onClose();
    document.addEventListener("keydown",h);
    return()=>document.removeEventListener("keydown",h);
  },[open,onClose]);
  if(!open)return null;
  return <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(20,40,20,.5)",backdropFilter:"blur(3px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{background:G.surface,borderRadius:16,width:"100%",maxWidth:width,maxHeight:"94vh",display:"flex",flexDirection:"column",boxShadow:"0 28px 72px rgba(0,0,0,.28)",animation:"su .2s ease"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 22px",borderBottom:"1px solid "+G.border,flexShrink:0}}>
        <h2 style={{margin:0,fontSize:15,fontWeight:800,color:G.text}}>{title}</h2>
        <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:G.muted,lineHeight:1,padding:4}}>✕</button>
      </div>
      <div style={{overflowY:"auto",flex:1,padding:"18px 22px"}}>{children}</div>
      {footer&&<div style={{padding:"14px 22px",borderTop:"1px solid "+G.border,display:"flex",gap:8,justifyContent:"flex-end",flexShrink:0}}>{footer}</div>}
    </div>
  </div>;
}
export function Logo({size=36}){
  return <svg width={size} height={size} viewBox="0 0 52 52">
    <rect x="0"  y="0"  width="23" height="23" rx="5" fill={G.green}/>
    <rect x="29" y="0"  width="23" height="23" rx="5" fill={G.red}/>
    <rect x="0"  y="29" width="23" height="23" rx="5" fill={G.gold}/>
    <rect x="29" y="29" width="23" height="23" rx="5" fill="#222"/>
  </svg>;
}
export function Badge({n,color=G.red}){
  if(!n)return null;
  return <span style={{background:color,color:"#fff",borderRadius:20,fontSize:9,fontWeight:800,padding:"1px 5px",minWidth:16,textAlign:"center"}}>{n>99?"99+":n}</span>;
}
export function EmptyState({icon="📭",title,subtitle}){
  return <div style={{textAlign:"center",padding:"60px 20px",color:G.light}}>
    <div style={{fontSize:52,marginBottom:12}}>{icon}</div>
    <div style={{fontSize:16,fontWeight:700,color:G.muted,marginBottom:6}}>{title}</div>
    {subtitle&&<div style={{fontSize:13}}>{subtitle}</div>}
  </div>;
}
export function Section({title,right,children,style:sx={}}){
  return <div style={{marginBottom:20,...sx}}>
    {(title||right)&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
      {title&&<div style={{fontSize:13,fontWeight:800,color:G.text,textTransform:"uppercase",letterSpacing:"0.05em"}}>{title}</div>}
      {right}
    </div>}
    {children}
  </div>;
}
