import { BrowserRouter, Route, Routes } from "react-router-dom";
import HomePageFive from "./pages/HomePageFive";
import HomePageFour from "./pages/HomePageFour";
import HomePageOne from "./pages/HomePageOne";
import HomePageSeven from "./pages/HomePageSeven";
import HomePageSix from "./pages/HomePageSix";
import HomePageThree from "./pages/HomePageThree";
import HomePageTwo from "./pages/HomePageTwo";
// import EmailPage from "./pages/EmailPage";
import AddUserPage from "./pages/AddUserPage";
import AddAdminPage from "./pages/AddAdminPage";
import AdminListPage from "./pages/AdminListPage";
import ViewAdminPage from "./pages/ViewAdminPage";
import EditAdminPage from "./pages/EditAdminPage";
import ResellerListPage from "./pages/ResellerListPage";
import ViewResellerPage from "./pages/ViewResellerPage";
import EditResellerPage from "./pages/EditResellerPage";
import SubscriptionPlanListPage from "./pages/SubscriptionPlanListPage";
import AddSubscriptionPlanPage from "./pages/AddSubscriptionPlanPage";
import ViewSubscriptionPlanPage from "./pages/ViewSubscriptionPlanPage";
import EditSubscriptionPlanPage from "./pages/EditSubscriptionPlanPage";
import AssignRolePage from "./pages/AssignRolePage";
import AdminSettingPage from "./pages/AdminSettingPage";
// import CalendarMainPage from "./pages/CalendarMainPage";
// import CarouselPage from "./pages/CarouselPage";
// import ChatMessagePage from "./pages/ChatMessagePage";
import ChatProfilePage from "./pages/ChatProfilePage";
import CodeGeneratorNewPage from "./pages/CodeGeneratorNewPage";
import CodeGeneratorPage from "./pages/CodeGeneratorPage";
// import ColorsPage from "./pages/ColorsPage";
import CompanyPage from "./pages/CompanyPage";
import DropdownPage from "./pages/DropdownPage";
import ErrorPage from "./pages/ErrorPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import InvoiceAddPage from "./pages/InvoiceAddPage";
import InvoiceEditPage from "./pages/InvoiceEditPage";
import InvoiceListPage from "./pages/InvoiceListPage";
import InvoicePreviewPage from "./pages/InvoicePreviewPage";
// import KanbanPage from "./pages/KanbanPage";
import LanguagePage from "./pages/LanguagePage";
import MarketplaceDetailsPage from "./pages/MarketplaceDetailsPage";
import MarketplacePage from "./pages/MarketplacePage";
import NotificationAlertPage from "./pages/NotificationAlertPage";
import NotificationPage from "./pages/NotificationPage";
import PaymentGatewayPage from "./pages/PaymentGatewayPage";
import SignInPage from "./pages/public/SignIn";
import SignUpPage from "./pages/public/Signup";
import Razorpay from "./pages/Razorpay";
import RoleAccessPage from "./pages/RoleAccessPage";
import Smtp from "./pages/SMTP";
import Smtptemplate from "./pages/Smtptemplate";
import StarredPage from "./pages/StarredPage";
import TermsConditionPage from "./pages/TermsConditionPage";
import TextGeneratorPage from "./pages/TextGeneratorPage";
import ThemePage from "./pages/ThemePage";
import Whatsapp from "./pages/Whatsapp";
import Whatsapptemp from "./pages/Whatsapptemp";
// import TypographyPage from "./pages/TypographyPage";
import ProtectedRoutes from "./helper/ProtectedRoutes";
import RouteScrollToTop from "./helper/RouteScrollToTop";
import AccessDeniedPage from "./pages/AccessDeniedPage";
import BlankPagePage from "./pages/BlankPagePage";
import ComingSoonPage from "./pages/ComingSoonPage";
import HomePageEight from "./pages/HomePageEight";
import HomePageEleven from "./pages/HomePageEleven";
import HomePageNine from "./pages/HomePageNine";
import HomePageTen from "./pages/HomePageTen";
import MaintenancePage from "./pages/MaintenancePage";
import TextGeneratorNewPage from "./pages/TextGeneratorNewPage";
import UsersGridPage from "./pages/UsersGridPage";
import UsersListPage from "./pages/UsersListPage";
import VideoGeneratorPage from "./pages/VideoGeneratorPage";
import ViewDetailsPage from "./pages/ViewDetailsPage";
import ViewProfilePage from "./pages/ViewProfilePage";
import VoiceGeneratorPage from "./pages/VoiceGeneratorPage";
import WalletPage from "./pages/WalletPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import ClientHubPage from "./pages/public/ClientHub/index";
import CustomerListPage from "./pages/CustomerListPage";
import ViewCustomerPage from "./pages/ViewCustomerPage";
import TransactionListPage from "./pages/TransactionListPage";
import ViewUserPage from "./pages/ViewUserPage";
import ResellerDashboardPage from "./pages/ResellerDashboardPage";
import { PermissionProvider } from "@/contexts/PermissionContext";


function App() {
  return (
    <PermissionProvider>
      <BrowserRouter>
        <RouteScrollToTop />
        <Routes>
        {/* Public routes */}
        <Route exact path='/sign-in' element={<SignInPage />} />
        <Route exact path='/sign-up' element={<SignUpPage />} />
        <Route exact path='/forgot-password' element={<ForgotPasswordPage />} />
        <Route exact path='/reset-password' element={<ResetPasswordPage />} />
        <Route exact path='/clienthub/:resellerId' element={<ClientHubPage />} />
        <Route exact path='/access-denied' element={<AccessDeniedPage />} />
        <Route exact path='/coming-soon' element={<ComingSoonPage />} />
        <Route exact path='/maintenance' element={<MaintenancePage />} />
        <Route exact path='/blank-page' element={<BlankPagePage />} />

        {/* Protected routes - require static admin login */}
        <Route element={<ProtectedRoutes />}>
          <Route exact path='/' element={<HomePageOne />} />
          <Route exact path='/index-2' element={<HomePageTwo />} />
          <Route exact path='/index-3' element={<HomePageThree />} />
          <Route exact path='/index-4' element={<HomePageFour />} />
          <Route exact path='/index-5' element={<HomePageFive />} />
          <Route exact path='/index-6' element={<HomePageSix />} />
          <Route exact path='/index-7' element={<HomePageSeven />} />
          <Route exact path='/index-8' element={<HomePageEight />} />
          <Route exact path='/index-9' element={<HomePageNine />} />
          <Route exact path='/index-10' element={<HomePageTen />} />
          <Route exact path='/index-11' element={<HomePageEleven />} />

          {/* SL */}
          <Route exact path='/add-admin' element={<AddAdminPage />} />
          <Route exact path='/view-admin/:id' element={<ViewAdminPage />} />
          <Route exact path='/edit-admin/:id' element={<EditAdminPage />} />
          <Route exact path='/reseller-list' element={<ResellerListPage />} />
          <Route exact path='/view-reseller/:id' element={<ViewResellerPage />} />
          <Route exact path='/edit-reseller/:id' element={<EditResellerPage />} />
          <Route exact path='/subscription-plan-list' element={<SubscriptionPlanListPage />} />
          <Route exact path='/add-subscription-plan' element={<AddSubscriptionPlanPage />} />
          <Route exact path='/view-subscription-plan/:id' element={<ViewSubscriptionPlanPage />} />
          <Route exact path='/edit-subscription-plan/:id' element={<EditSubscriptionPlanPage />} />
          <Route exact path='/customer-list' element={<CustomerListPage />} />
          <Route exact path='/view-customer/:id' element={<ViewCustomerPage />} />
          <Route exact path='/transaction-list' element={<TransactionListPage />} />
          <Route exact path='/users-list' element={<UsersListPage />} />
          <Route exact path='/view-user/:id' element={<ViewUserPage />} />
          <Route exact path='/reseller-dashboard' element={<ResellerDashboardPage />} />
          {/* <Route exact path='/alert' element={<AlertPage />} /> */}
          <Route exact path='/assign-role' element={<AssignRolePage />} />
          <Route exact path='/role-access' element={<RoleAccessPage />} />
          <Route exact path='/admin-setting' element={<AdminSettingPage />} />
          {/* <Route exact path='/avatar' element={<AvatarPage />} /> */}
          {/* <Route exact path='/badges' element={<BadgesPage />} /> */}
          {/* <Route exact path='/button' element={<ButtonPage />} /> */}
          {/* <Route exact path='/card' element={<CardPage />} /> */}
          {/* <Route exact path='/carousel' element={<CarouselPage />} /> */}
          <Route exact path='/chat-profile' element={<ChatProfilePage />} />
          <Route exact path='/code-generator' element={<CodeGeneratorPage />} />
          <Route exact path='/code-generator-new' element={<CodeGeneratorNewPage />} />
          {/* <Route exact path='/colors' element={<ColorsPage />} /> */}
          {/* <Route exact path='/column-chart' element={<ColumnChartPage />} /> */}
          <Route exact path='/company' element={<CompanyPage />} />
          {/* <Route exact path='/currencies' element={<CurrenciesPage />} /> */}
          <Route exact path='/dropdown' element={<DropdownPage />} />
          {/* <Route exact path='/faq' element={<FaqPage />} /> */}
          {/* <Route exact path='/form-layout' element={<FormLayoutPage />} /> */}
          {/* <Route exact path='/form-validation' element={<FormValidationPage />} /> */}
          {/* <Route exact path='/form' element={<FormPage />} /> */}

          {/* <Route exact path='/gallery' element={<GalleryPage />} /> */}
          {/* <Route exact path='/gallery-grid' element={<GalleryGridPage />} /> */}
          {/* <Route exact path='/gallery-masonry' element={<GalleryMasonryPage />} /> */}
          {/* <Route exact path='/gallery-hover' element={<GalleryHoverPage />} /> */}

          {/* <Route exact path='/blog' element={<BlogPage />} />
          <Route exact path='/blog-details' element={<BlogDetailsPage />} />
          <Route exact path='/add-blog' element={<AddBlogPage />} /> */}

          {/* <Route exact path='/testimonials' element={<TestimonialsPage />} /> */}

          {/* <Route exact path='/image-generator' element={<ImageGeneratorPage />} /> */}
          {/* <Route exact path='/image-upload' element={<ImageUploadPage />} /> */}
          <Route exact path='/invoice-add' element={<InvoiceAddPage />} />
          <Route exact path='/invoice-edit' element={<InvoiceEditPage />} />
          <Route exact path='/invoice-list' element={<InvoiceListPage />} />
          <Route exact path='/invoice-preview' element={<InvoicePreviewPage />} />
          <Route exact path='/language' element={<LanguagePage />} />
          {/* <Route exact path='/line-chart' element={<LineChartPage />} /> */}
          {/* <Route exact path='/list' element={<ListPage />} /> */}
          <Route exact path='/marketplace-details' element={<MarketplaceDetailsPage />} />
          <Route exact path='/marketplace' element={<MarketplacePage />} />
          <Route exact path='/notification-alert' element={<NotificationAlertPage />} />
          <Route exact path='/notification' element={<NotificationPage />} />
          <Route exact path='/smtp' element={<Smtp />} />
          <Route exact path='/razorpay' element={<Razorpay />} />
          <Route exact path='/whatsapptemp' element={<Whatsapptemp />} />
          <Route exact path='/smtptemplate' element={<Smtptemplate />} />
          <Route exact path='/whatsapp' element={<Whatsapp />} />
          {/* <Route exact path='/pagination' element={<PaginationPage />} /> */}
          <Route exact path='/payment-gateway' element={<PaymentGatewayPage />} />
          {/* <Route exact path='/pie-chart' element={<PieChartPage />} /> */}
          {/* <Route exact path='/portfolio' element={<PortfolioPage />} /> */}
          {/* <Route exact path='/pricing' element={<PricingPage />} /> */}
          {/* <Route exact path='/progress' element={<ProgressPage />} /> */}
          {/* <Route exact path='/radio' element={<RadioPage />} /> */}
          {/* <Route exact path='/star-rating' element={<StarRatingPage />} /> */}
          <Route exact path='/starred' element={<StarredPage />} />
          {/* <Route exact path='/switch' element={<SwitchPage />} /> */}
          {/* <Route exact path='/table-basic' element={<TableBasicPage />} /> */}
          {/* <Route exact path='/table-data' element={<TableDataPage />} /> */}
          {/* <Route exact path='/tabs' element={<TabsPage />} /> */}
          {/* <Route exact path='/tags' element={<TagsPage />} /> */}
          <Route exact path='/terms-condition' element={<TermsConditionPage />} />
          <Route exact path='/text-generator-new' element={<TextGeneratorNewPage />} />
          <Route exact path='/text-generator' element={<TextGeneratorPage />} />
          <Route exact path='/theme' element={<ThemePage />} />
          {/* <Route exact path='/tooltip' element={<TooltipPage />} /> */}
          {/* <Route exact path='/typography' element={<TypographyPage />} /> */}
          <Route exact path='/users-grid' element={<UsersGridPage />} />
          <Route exact path='/admin-list' element={<AdminListPage />} />
          <Route exact path='/view-details' element={<ViewDetailsPage />} />
          <Route exact path='/video-generator' element={<VideoGeneratorPage />} />
          {/* <Route exact path='/videos' element={<VideosPage />} /> */}
          <Route exact path='/view-profile' element={<ViewProfilePage />} />
          <Route exact path='/voice-generator' element={<VoiceGeneratorPage />} />
          <Route exact path='/wallet' element={<WalletPage />} />
          <Route exact path='/change-password' element={<ChangePasswordPage />} />
          {/* <Route exact path='/widgets' element={<WidgetsPage />} /> */}
          {/* <Route exact path='/wizard' element={<WizardPage />} /> */}
        </Route>

        {/* Catch-all */}
        <Route exact path='*' element={<ErrorPage />} />
        </Routes>
      </BrowserRouter>
    </PermissionProvider>
  );
}

export default App;
