'use client';
import {useTheme} from 'next-themes';
import {Moon,Sun} from 'lucide-react';
export function ThemeToggle(){
 const {setTheme}=useTheme();
 return <button className="theme-toggle" type="button" onClick={()=>setTheme(document.documentElement.classList.contains('dark')?'light':'dark')} aria-label="Cambiar entre modo claro y oscuro" title="Cambiar entre modo claro y oscuro"><Moon className="theme-moon" size={18} aria-hidden="true"/><Sun className="theme-sun" size={18} aria-hidden="true"/></button>;
}
