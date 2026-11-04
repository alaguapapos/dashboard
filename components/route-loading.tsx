import {LoaderCircle} from 'lucide-react';
import styles from './route-loading.module.css';

export function RouteLoading() {
  return <main className={styles.page} aria-busy="true">
    <div className={styles.status} role="status"><LoaderCircle size={22} aria-hidden="true"/><p>Abriendo sección…</p></div>
  </main>;
}
