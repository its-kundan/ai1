import { useEffect } from 'react'
import TopBar from '../components/TopBar'
import Sidebar from '../components/Sidebar'
import ChatBox from '../components/ChatBox'
import { useChatStore } from '../store/chatStore'
import { useChatCache } from '../hooks/useChatCache'

const Home = () => {
  const { isInitialized } = useChatCache()

  useEffect(() => {
    // Ensure store is initialized
    if (!isInitialized) {
      useChatStore.getState().initialize()
    }
  }, [isInitialized])

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden bg-white dark:bg-gray-900">
          <ChatBox />
        </main>
      </div>
    </div>
  )
}

export default Home
