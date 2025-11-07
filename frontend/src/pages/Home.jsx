import { useEffect } from 'react'
import TopBar from '../components/TopBar'
import Sidebar from '../components/Sidebar'
import ChatBox from '../components/ChatBox'
import FileUpload from '../components/FileUpload'
import SearchBar from '../components/SearchBar'
import { useChatStore } from '../store/chatStore'
import { useChatCache } from '../hooks/useChatCache'

const Home = () => {
  const activeTab = useChatStore(state => state.activeTab)
  const { isInitialized } = useChatCache()

  useEffect(() => {
    // Ensure store is initialized
    if (!isInitialized) {
      useChatStore.getState().initialize()
    }
  }, [isInitialized])

  const renderMainContent = () => {
    switch (activeTab) {
      case 'upload':
        return <FileUpload />
      case 'search':
        return <SearchBar />
      case 'chat':
      default:
        return <ChatBox />
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden bg-white dark:bg-gray-900">
          {renderMainContent()}
        </main>
      </div>
    </div>
  )
}

export default Home
