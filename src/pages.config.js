import AdminDashboard from './pages/AdminDashboard';
import ClientSearch from './pages/ClientSearch';
import ClipManagement from './pages/ClipManagement';
import ClipPublisher from './pages/ClipPublisher';
import UserManagement from './pages/UserManagement';
import VideoReview from './pages/VideoReview';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminDashboard": AdminDashboard,
    "ClientSearch": ClientSearch,
    "ClipManagement": ClipManagement,
    "ClipPublisher": ClipPublisher,
    "UserManagement": UserManagement,
    "VideoReview": VideoReview,
}

export const pagesConfig = {
    mainPage: "AdminDashboard",
    Pages: PAGES,
    Layout: __Layout,
};