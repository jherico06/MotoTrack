import { selectNativeScreen } from '../platform/selectScreen.js';

// ─── iOS PLATFORM SCREENS (Apple HIG) ──────────────────────────────────────────
import ShopPageIos from '../platforms/ios/screens/customer/ShopPage.jsx';
import ProfilePageIos from '../platforms/ios/screens/customer/ProfilePage.jsx';
import OrderPageIos from '../platforms/ios/screens/customer/OrderPage.jsx';
import GaragePageIos from '../platforms/ios/screens/customer/GaragePage.jsx';
import WishlistPageIos from '../platforms/ios/screens/customer/WishlistPage.jsx';
import CustomizerPageIos from '../platforms/ios/screens/customer/CustomizerPage.jsx';
import NotificationsPageIos from '../platforms/ios/screens/customer/NotificationsPage.jsx';
import LoginPageIos from '../platforms/ios/screens/auth/LoginPage.jsx';
import SignUpPageIos from '../platforms/ios/screens/auth/SignUpPage.jsx';
import RiderDashboardIos from '../platforms/ios/screens/rider/RiderDashboard.jsx';
import RiderRunPageIos from '../platforms/ios/screens/rider/RiderRunPage.jsx';

// ─── ANDROID PLATFORM SCREENS (Material Design 3) ────────────────────────────
import ShopPageAndroid from '../platforms/android/screens/customer/ShopPage.jsx';
import ProfilePageAndroid from '../platforms/android/screens/customer/ProfilePage.jsx';
import OrderPageAndroid from '../platforms/android/screens/customer/OrderPage.jsx';
import GaragePageAndroid from '../platforms/android/screens/customer/GaragePage.jsx';
import WishlistPageAndroid from '../platforms/android/screens/customer/WishlistPage.jsx';
import CustomizerPageAndroid from '../platforms/android/screens/customer/CustomizerPage.jsx';
import NotificationsPageAndroid from '../platforms/android/screens/customer/NotificationsPage.jsx';
import LoginPageAndroid from '../platforms/android/screens/auth/LoginPage.jsx';
import SignUpPageAndroid from '../platforms/android/screens/auth/SignUpPage.jsx';
import RiderDashboardAndroid from '../platforms/android/screens/rider/RiderDashboard.jsx';
import RiderRunPageAndroid from '../platforms/android/screens/rider/RiderRunPage.jsx';

// ─── SHARED MOBILE SCREENS ────────────────────────────────────────────────────
import AdminDashboardMobile from '../screens/mobile/admin/AdminDashboard.jsx';
import DeliveryConfirmPageShared from '../screens/shared/delivery/DeliveryConfirmPage.jsx';
import ProductDetailsPageShared from '../screens/shared/customer/ProductDetailsPage.jsx';
import StaffVerifyEmailPageShared from '../screens/shared/auth/StaffVerifyEmailPage.jsx';
import ForceChangePasswordPageShared from '../screens/shared/auth/ForceChangePasswordPage.jsx';

// ─── WEB SCREENS (Completely Isolated & Untouched) ─────────────────────────────
import ShopPageWeb from '../screens/web/customer/ShopPage.jsx';
import LoginPageWeb from '../screens/web/auth/LoginPage.jsx';
import SignUpPageWeb from '../screens/web/auth/SignUpPage.jsx';
import OrderPageWeb from '../screens/web/customer/OrderPage.jsx';
import GaragePageWeb from '../screens/web/customer/GaragePage.jsx';
import WishlistPageWeb from '../screens/web/customer/WishlistPage.jsx';
import AdminDashboardWeb from '../screens/web/admin/AdminDashboard.jsx';
import CustomizerPageWeb from '../screens/web/customer/CustomizerPage.jsx';
import ProfilePageWeb from '../screens/web/customer/ProfilePage.jsx';
import NotificationsPageWeb from '../screens/web/customer/NotificationsPage.jsx';
import RiderDashboardWeb from '../screens/web/rider/RiderDashboard.jsx';

// ─── PLATFORM DISPATCH EXPORTS ───────────────────────────────────────────────
export const ShopPage = selectNativeScreen(ShopPageAndroid, { ios: ShopPageIos, web: ShopPageWeb });
export const LoginPage = selectNativeScreen(LoginPageAndroid, { ios: LoginPageIos, web: LoginPageWeb });
export const SignUpPage = selectNativeScreen(SignUpPageAndroid, { ios: SignUpPageIos, web: SignUpPageWeb });
export const OrderPage = selectNativeScreen(OrderPageAndroid, { ios: OrderPageIos, web: OrderPageWeb });
export const GaragePage = selectNativeScreen(GaragePageAndroid, { ios: GaragePageIos, web: GaragePageWeb });
export const WishlistPage = selectNativeScreen(WishlistPageAndroid, { ios: WishlistPageIos, web: WishlistPageWeb });
export const AdminDashboard = selectNativeScreen(AdminDashboardMobile, { web: AdminDashboardWeb });
export const CustomizerPage = selectNativeScreen(CustomizerPageAndroid, { ios: CustomizerPageIos, web: CustomizerPageWeb });
export const ProfilePage = selectNativeScreen(ProfilePageAndroid, { ios: ProfilePageIos, web: ProfilePageWeb });
export const NotificationsPage = selectNativeScreen(NotificationsPageAndroid, { ios: NotificationsPageIos, web: NotificationsPageWeb });
export const DeliveryConfirmPage = selectNativeScreen(DeliveryConfirmPageShared);
export const RiderRunPage = selectNativeScreen(RiderRunPageAndroid, { ios: RiderRunPageIos });
export const RiderDashboard = selectNativeScreen(RiderDashboardAndroid, { ios: RiderDashboardIos, web: RiderDashboardWeb });
export const ProductDetailsPage = selectNativeScreen(ProductDetailsPageShared);
export const StaffVerifyEmailPage = selectNativeScreen(StaffVerifyEmailPageShared);
export const ForceChangePasswordPage = selectNativeScreen(ForceChangePasswordPageShared);
