import { useLocation, Link } from 'react-router-dom';

export default function PageNotFound() {
    const location = useLocation();
    const pageName = location.pathname.substring(1) || 'unknown';

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="space-y-2">
                    <h1 className="text-7xl font-mono font-light text-muted-foreground/40">404</h1>
                    <div className="h-0.5 w-16 bg-border mx-auto"></div>
                </div>
                <div className="space-y-3">
                    <h2 className="text-2xl font-mono font-medium text-foreground">Page Not Found</h2>
                    <p className="font-mono text-sm text-muted-foreground">
                        The page <span className="text-primary">"{pageName}"</span> doesn't exist.
                    </p>
                </div>
                <div className="pt-2">
                    <Link to="/" className="inline-flex items-center px-4 py-2 text-sm font-mono text-foreground bg-secondary border border-border rounded-lg hover:border-primary/50 transition-colors">
                        ← Go Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
