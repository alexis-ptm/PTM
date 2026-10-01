import "./globals.css";

export const metadata = {
  title: "Markup",
  description: "Pin-and-comment reviews for client websites",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
