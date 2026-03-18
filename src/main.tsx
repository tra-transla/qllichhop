import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import ResizeObserver from 'resize-observer-polyfill';

// Polyfill ResizeObserver globally for older browsers
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = ResizeObserver;
}

console.log('Hệ thống đang khởi động...');

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Không tìm thấy phần tử root');
  }
  
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  console.log('React đã được render thành công');
} catch (error) {
  console.error('Lỗi khi khởi động React:', error);
  // Fallback UI if React fails
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = '<div style="padding: 20px; color: red; text-align: center;">' +
      '<h2>Lỗi khởi động hệ thống</h2>' +
      '<p>Trình duyệt của bạn có thể không tương thích hoặc có lỗi xảy ra.</p>' +
      '<pre style="text-align: left; background: #eee; padding: 10px; font-size: 12px;">' + error + '</pre>' +
      '</div>';
  }
}
