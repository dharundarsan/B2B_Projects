import { useAuth } from '../../providers/AuthProvider';
import ResidentHome from '../../screens/ResidentHome';
import WatchmanHome from '../../screens/WatchmanHome';
export default function Home() { return useAuth().context?.role === 'watchman' ? <WatchmanHome /> : <ResidentHome />; }
