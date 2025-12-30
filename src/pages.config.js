import AdminDashboard from './pages/AdminDashboard';
import ClientSearch from './pages/ClientSearch';
import ClipManagement from './pages/ClipManagement';
import ClipPublisher from './pages/ClipPublisher';
import VideoReview from './pages/VideoReview';


export const PAGES = {
    "AdminDashboard": AdminDashboard,
    "ClientSearch": ClientSearch,
    "ClipManagement": ClipManagement,
    "ClipPublisher": ClipPublisher,
    "VideoReview": VideoReview,
}

export const pagesConfig = {
    mainPage: "AdminDashboard",
    Pages: PAGES,
};