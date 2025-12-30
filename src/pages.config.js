import AdminDashboard from './pages/AdminDashboard';
import VideoReview from './pages/VideoReview';
import ClipPublisher from './pages/ClipPublisher';
import ClientSearch from './pages/ClientSearch';


export const PAGES = {
    "AdminDashboard": AdminDashboard,
    "VideoReview": VideoReview,
    "ClipPublisher": ClipPublisher,
    "ClientSearch": ClientSearch,
}

export const pagesConfig = {
    mainPage: "AdminDashboard",
    Pages: PAGES,
};