import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { AppRouter } from './router'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppRouter />
      </ToastProvider>
    </BrowserRouter>
  )
}
