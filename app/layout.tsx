import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { PwaRegister } from "@/components/providers/pwa-register";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AiStatusProvider } from "@/lib/ai-status-context";
import { Toaster } from "sonner";
import {
  APPLICATION_JSON_LD,
  ORGANIZATION_JSON_LD,
  SITE_AUTHOR,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_LOCALE,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_TWITTER,
  SITE_URL,
  pageMetadataBase,
} from "@/lib/seo";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: pageMetadataBase(),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  authors: [SITE_AUTHOR],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  applicationName: SITE_NAME,
  referrer: "origin-when-cross-origin",
  generator: "Next.js",
  category: "developer tools",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: SITE_LOCALE,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: SITE_TWITTER,
    creator: SITE_TWITTER,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: ["/twitter-image"],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    email: false,
    telephone: false,
    address: false,
  },
  icons: {
    icon: [
      { url: "/icon", type: "image/png", sizes: "32x32" },
      { url: "/logo.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-icon",
    shortcut: "/logo.svg",
  },
  // Verification placeholders — uncomment + populate before launch.
  // verification: {
  //   google: "...",
  //   yandex: "...",
  //   other: { "msvalidate.01": "..." },
  // },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0f" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        {/* Structured data — Organization + SoftwareApplication. Helps Google
            render rich-result cards and surface the app under the right
            knowledge-graph entities. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(ORGANIZATION_JSON_LD),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(APPLICATION_JSON_LD),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <AuthSessionProvider>
          <ThemeProvider>
            <TooltipProvider delay={300} closeDelay={50}>
              <AiStatusProvider>{children}</AiStatusProvider>
            </TooltipProvider>
            <PwaRegister />
            <Toaster
              closeButton
              position="bottom-right"
              theme="system"
              offset={20}
              mobileOffset={20}
              gap={10}
              toastOptions={{
                classNames: {
                  toast:
                    "group/toast pointer-events-auto !flex w-full items-center !gap-3 !rounded-2xl !border !border-border !bg-card/95 !px-3.5 !py-3 !pr-10 !text-sm !text-foreground !shadow-[0_8px_30px_-10px_rgba(0,0,0,0.25)] backdrop-blur-md",
                  title: "!font-semibold !leading-tight !text-[13px]",
                  description:
                    "!mt-0.5 !text-[11.5px] !leading-snug !text-muted-foreground",
                  icon: "!flex !size-9 !shrink-0 !items-center !justify-center !rounded-full !bg-primary/15 !text-primary [&_svg]:!size-4",
                  closeButton:
                    "!absolute !right-2.5 !top-1/2 !left-auto !bottom-auto !size-6 !rounded-full !border-0 !bg-transparent !text-muted-foreground !p-0 !m-0 hover:!bg-muted hover:!text-foreground [&_svg]:!size-3.5 [&_svg]:!opacity-100 [transform:translateY(-50%)!important]",
                  actionButton:
                    "!h-8 !rounded-full !bg-primary !px-3.5 !text-[12px] !font-semibold !text-primary-foreground hover:!bg-primary/90",
                  cancelButton:
                    "!h-8 !rounded-full !border !border-border !bg-card !px-3.5 !text-[12px] !font-medium !text-foreground hover:!bg-muted",
                  success:
                    "[&_[data-icon]]:!bg-emerald-500/15 [&_[data-icon]]:!text-emerald-600",
                  error:
                    "[&_[data-icon]]:!bg-red-500/15 [&_[data-icon]]:!text-red-600",
                  warning:
                    "[&_[data-icon]]:!bg-amber-500/15 [&_[data-icon]]:!text-amber-600",
                  info: "[&_[data-icon]]:!bg-cyan-500/15 [&_[data-icon]]:!text-cyan-600",
                },
              }}
            />
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
