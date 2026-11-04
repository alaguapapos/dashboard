import type { Metadata } from 'next';
import './globals.css';
import {NavigationSnapshotProvider} from '@/components/navigation-snapshots';
import {ThemeProvider} from '@/components/theme-provider';
export const metadata: Metadata = {title: 'Al Agua Papos · Resumen del negocio', description: 'Ventas, gastos y depósitos en un solo lugar.'};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {return <html lang="es" suppressHydrationWarning><body><ThemeProvider><NavigationSnapshotProvider>{children}</NavigationSnapshotProvider></ThemeProvider></body></html>}
