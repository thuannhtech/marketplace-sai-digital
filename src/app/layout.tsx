import type { Metadata } from 'next'
import './globals.css'
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { MarketplaceProvider } from '@/src/providers/MarketplaceProvider'
import { BrowserLayout } from '@/src/components/layout/BrowserLayout'

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'Sitecore Marketplace Extensions',
  description: 'Sitecore Marketplace extension starter application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="antialiased selection:bg-primary-100 selection:text-primary-900">
        <MarketplaceProvider>
          <BrowserLayout>
            {children}
          </BrowserLayout>
        </MarketplaceProvider>
      </body>
    </html>
  )
}
