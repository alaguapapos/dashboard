'use client';

import Link, {useLinkStatus} from 'next/link';
import {useState, type ReactNode} from 'react';
import {Dialog} from 'radix-ui';
import {LayoutDashboard, ArrowDownLeft, ArrowUpRight, Wallet, Users, Package, Ellipsis, X, LoaderCircle} from 'lucide-react';
import styles from './mobile-navigation.module.css';

const items = [
  {label:'Resumen', Icon:LayoutDashboard, href:'/'},
  {label:'Ventas', Icon:ArrowDownLeft, href:'/?view=Ventas'},
  {label:'Inventario', Icon:Package, href:'/inventario'},
  {label:'Personal', Icon:Users, href:'/personal'},
];
const extras = [
  {label:'Egresos', description:'Gastos del negocio', Icon:ArrowUpRight, href:'/?view=Egresos'},
  {label:'Depósitos', description:'Depósitos y conciliación', Icon:Wallet, href:'/?view=Dep%C3%B3sitos'},
];

function LinkContent({children}: {children:ReactNode}) {
  const {pending} = useLinkStatus();
  return <>
    <span className={styles.linkContent} data-pending={pending || undefined}>{children}</span>
    {pending && <span className={styles.pending} role="status"><LoaderCircle size={20} aria-hidden="true"/><span className={styles.srOnly}>Abriendo sección…</span></span>}
  </>;
}

export function MobileNavigation({active, onNavigate}: {active:string; onNavigate?:(view:string)=>void}) {
  const [more, setMore] = useState(false);
  const moreActive = extras.some(item => item.label === active);

  return <Dialog.Root open={more} onOpenChange={setMore}>
    <nav className={styles.nav} aria-label="Navegación principal">
      {items.map(({label, Icon, href}) => {
        const className = `${styles.item} ${active === label ? styles.active : ''}`;
        const content = <><Icon size={20} aria-hidden="true"/><span>{label}</span></>;
        return onNavigate && ['Resumen','Ventas'].includes(label)
          ? <button key={label} type="button" aria-current={active === label ? 'page' : undefined} className={className} onClick={() => onNavigate(label)}>{content}</button>
          : <Link key={label} href={href} aria-current={active === label ? 'page' : undefined} className={className}><LinkContent>{content}</LinkContent></Link>;
      })}
      <Dialog.Trigger asChild>
        <button type="button" aria-current={moreActive ? 'page' : undefined} className={`${styles.item} ${moreActive ? styles.active : ''}`}><Ellipsis size={20} aria-hidden="true"/><span>Más</span></button>
      </Dialog.Trigger>
    </nav>
    <Dialog.Portal>
      <Dialog.Overlay className={styles.overlay}/>
      <Dialog.Content className={styles.sheet}>
        <div className={styles.heading}>
          <div><Dialog.Title>Más opciones</Dialog.Title><Dialog.Description>Finanzas del negocio</Dialog.Description></div>
          <Dialog.Close className={styles.close} aria-label="Cerrar opciones"><X size={20}/></Dialog.Close>
        </div>
        {extras.map(({label, description, Icon, href}) => {
          const content = <><Icon size={21} aria-hidden="true"/><span><strong>{label}</strong><small>{description}</small></span></>;
          const current = active === label ? 'page' as const : undefined;
          return onNavigate
            ? <button type="button" key={label} aria-current={current} className={styles.destination} onClick={() => {onNavigate(label); setMore(false);}}>{content}</button>
            : <Link key={label} aria-current={current} className={styles.destination} href={href}><LinkContent>{content}</LinkContent></Link>;
        })}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
