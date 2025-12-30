import AdminDashboard from './pages/AdminDashboard';
import ClientSearch from './pages/ClientSearch';
import ClipPublisher from './pages/ClipPublisher';
import VideoReview from './pages/VideoReview';
import ClipManagement from './pages/ClipManagement';


export const PAGES = {
    "AdminDashboard": AdminDashboard,
    "ClientSearch": ClientSearch,
    "ClipPublisher": ClipPublisher,
    "VideoReview": VideoReview,
    "ClipManagement": ClipManagement,
}

export const pagesConfig = {
    mainPage: "AdminDashboard",
    Pages: PAGES,
};