'use client';
import {ThemeProvider as Provider} from 'next-themes';
export function ThemeProvider({children}:{children:React.ReactNode}){
 return <Provider attribute="class" defaultTheme="light" enableSystem={false} storageKey="alagua-theme" disableTransitionOnChange>{children}</Provider>;
}
