import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title: 'Al Agua Papos · Tu negocio, en claro', description: 'Ventas, gastos y depósitos en un solo lugar.'};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {return <html lang="es"><body>{children}</body></html>}
