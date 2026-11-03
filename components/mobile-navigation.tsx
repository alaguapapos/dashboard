'use client';
import Link from 'next/link';
import {LayoutDashboard,ArrowDownLeft,ArrowUpRight,Wallet,Users} from 'lucide-react';
const items=[{label:'Resumen',Icon:LayoutDashboard,href:'/'},{label:'Ventas',Icon:ArrowDownLeft,href:'/?view=Ventas'},{label:'Egresos',Icon:ArrowUpRight,href:'/?view=Egresos'},{label:'Depósitos',Icon:Wallet,href:'/?view=Dep%C3%B3sitos'},{label:'Personal',Icon:Users,href:'/personal'}];
export function MobileNavigation({active,onNavigate}:{active:string;onNavigate?:(view:string)=>void}){
 return <nav className="mobile-bottom-nav" aria-label="Navegación principal">{items.map(({label,Icon,href})=>onNavigate&&label!=='Personal'?<button key={label} type="button" aria-current={active===label?'page':undefined} className={active===label?'active':''} onClick={()=>onNavigate(label)}><Icon size={20}/><span>{label}</span></button>:<Link key={label} href={href} aria-current={active===label?'page':undefined} className={active===label?'active':''}><Icon size={20}/><span>{label}</span></Link>)}</nav>;
}
