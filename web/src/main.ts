import './style.css';
import { AppHUD } from './ui/AppHUD';

async function bootstrap() {
  const rootEl = document.getElementById('app');
  if (!rootEl) {
    throw new Error('Missing #app root container');
  }
  const app = new AppHUD(rootEl);
  await app.init();
}

bootstrap().catch((err) => {
  console.error('[Gate3 Inner Ear 3D Lab] Initialization error:', err);
});
