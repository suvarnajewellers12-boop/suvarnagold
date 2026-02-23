import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown } from "@/components/Crown";
import { Sparkles } from "@/components/Sparkles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Lock, User } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userType, setUserType] = useState<"admin" | "superadmin">("admin");

  const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);

  try {
    const endpoint =
       userType === "admin"
        ? "https://suvarnagold-nd6t.vercel.app/api/auth/admin-login"
        : "https://suvarnagold-nd6t.vercel.app/api/auth/super-admin-login";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Login failed");
    }

    // ✅ Save token
    localStorage.setItem("token", data.token);

    // Optional: Save role
    localStorage.setItem("role", userType);

    // Route based on role
    if (userType === "admin") {
      navigate("/admin");
    } else {
      navigate("/dashboard");
    }

  } catch (error: any) {
    console.error("Login error:", error);
    alert(error.message || "Something went wrong");
  } finally {
    setIsLoading(false);
  }
};


  return (
    <div className="min-h-screen animated-gradient flex items-center justify-center p-4 relative overflow-hidden">
      <Sparkles count={12} />
      
      {/* Decorative Elements */}
      <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-10 right-10 w-40 h-40 rounded-full bg-primary/10 blur-3xl" />
      
      <div className="w-full max-w-md fade-in-up">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-1">
            <img src="/logo.png" alt="Suvarna Logo" className="w-50 h-40" />
          </div>
          <h1 className="text-4xl font-serif font-bold text-primary-foreground mb-2">
            Suvarna Portal
          </h1>
          <p className="text-xl font-sans font-medium text-primary-foreground/90 leading-relaxed">
            Suvarna Jewellery Scheme Portal
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-card/95 backdrop-blur-sm rounded-2xl p-8 shadow-luxury border-2 border-primary/30">
          {/* User Type Toggle */}
          <div className="flex gap-2 mb-6 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setUserType("admin")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-300 ${
                userType === "admin"
                  ? "gradient-gold text-primary-foreground shadow-gold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Admin
            </button>
            <button
              onClick={() => setUserType("superadmin")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-300 ${
                userType === "superadmin"
                  ? "gradient-gold text-primary-foreground shadow-gold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Super Admin
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Username Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Enter your username"
                  className="pl-10"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className="pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <Button
              type="submit"
              variant="gold"
              size="lg"
              className="w-full mt-6"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Signing In...
                </div>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          {/* Footer */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            Secure access to your jewelry scheme management
          </p>
        </div>

        {/* Bottom Text */}
        <p className="text-center text-primary-foreground/60 text-sm mt-6">
          © 2024 Golden Crown Jewellers. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
