import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Asset Lift Lending — CRM',
  description: 'Private Lending CRM for Asset Lift Lending',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1A1A1A',
              color: '#fff',
              border: '1px solid #D4A017',
              borderRadius: '10px',
            },
            success: { iconTheme: { primary: '#D4A017', secondary: '#1A1A1A' } },
          }}
        />
      </body>
    </html>
  )
}
