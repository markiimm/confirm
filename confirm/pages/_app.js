import Head from 'next/head';
import '../styles/globals.css';
import { ToastProvider } from '../components/Toast';

export default function App({ Component, pageProps }) {
  return (
    <ToastProvider>
      <Head>
        <title>Confirmô</title>
      </Head>
      <Component {...pageProps} />
    </ToastProvider>
  );
}
