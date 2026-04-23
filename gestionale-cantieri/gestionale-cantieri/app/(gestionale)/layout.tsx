import Sidebar from '@/components/Sidebar'

export default function GestionaleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: 200, minHeight: '100vh', background: '#f0f0ed' }}>
        {children}
      </main>
    </div>
  )
}
