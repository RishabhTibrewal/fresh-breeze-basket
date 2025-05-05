import { Link } from "react-router-dom";
import { CheckCircle, ShoppingBag, Home } from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";

export default function ThankYouPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow bg-gray-50 py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="bg-white rounded-lg shadow-md p-8 md:p-12 text-center">
            <div className="mb-6 flex justify-center">
              <div className="h-24 w-24 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-14 w-14 text-green-600" />
              </div>
            </div>
            
            <h1 className="text-3xl font-bold mb-4 text-gray-900">Thank You for Your Order!</h1>
            <p className="text-lg text-gray-600 mb-8">
              Your order has been received and is being processed. You will receive a confirmation email shortly.
            </p>

            <div className="border-t border-b border-gray-200 py-6 mb-8">
              <p className="text-gray-600 mb-2">
                Order details and tracking information will be sent to your email address.
              </p>
              <p className="text-gray-600">
                Please allow 24 hours for order processing.
              </p>
            </div>

            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <Link to="/account/orders">
                <Button className="flex items-center">
                  <ShoppingBag className="mr-2 h-5 w-5" />
                  View My Orders
                </Button>
              </Link>
              <Link to="/">
                <Button variant="outline" className="flex items-center">
                  <Home className="mr-2 h-5 w-5" />
                  Continue Shopping
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
} 