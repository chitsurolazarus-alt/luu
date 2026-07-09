/* =====================================================================
   LUU TRAVELS & LOGISTICS - AUTHENTICATION MANAGER
   Requires config.js to be loaded first.
   ===================================================================== */

const AuthManager = {

    // Register a new customer: creates Supabase Auth user + row in `users` table
    async register({ fullName, email, phone, password }) {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName, phone } }
        });
        if (error) throw error;

        const authUser = data.user;
        if (authUser) {
            const { error: profileError } = await supabaseClient
                .from('users')
                .insert([{
                    id: authUser.id,
                    email,
                    full_name: fullName,
                    phone,
                    role: 'customer'
                }]);
            // Ignore duplicate-row errors (e.g. if a trigger already created the row)
            if (profileError && profileError.code !== '23505') throw profileError;
        }
        return data;
    },

    // Log a user in, returns their profile (including role) so caller can redirect
    async login({ email, password }) {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const profile = await this.getProfile(data.user.id);
        return { session: data.session, user: data.user, profile };
    },

    async logout() {
        await supabaseClient.auth.signOut();
    },

    async getProfile(userId) {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        if (error) throw error;
        return data;
    },

    async getCurrentUser() {
        const { data: { user } } = await supabaseClient.auth.getUser();
        return user;
    },

    async requireAuth(redirectTo = 'login.html') {
        const user = await this.getCurrentUser();
        if (!user) {
            window.location.href = redirectTo;
            return null;
        }
        return user;
    },

    // Redirects to admin dashboard if not an admin
    async requireAdmin(redirectTo = 'admin-login.html') {
        const user = await this.getCurrentUser();
        if (!user) {
            window.location.href = redirectTo;
            return null;
        }
        const profile = await this.getProfile(user.id);
        if (profile.role !== 'admin') {
            window.location.href = redirectTo;
            return null;
        }
        return { user, profile };
    },

    async sendPasswordReset(email) {
        const redirectUrl = `${window.location.origin}${pathPrefix()}reset-password.html`;
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: redirectUrl
        });
        if (error) throw error;
    },

    async updatePassword(newPassword) {
        const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
        if (error) throw error;
    }
};

// Password strength helper used by register.html
function passwordStrength(password) {
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { label: 'Weak', className: 'weak' };
    if (score <= 3) return { label: 'Medium', className: 'medium' };
    return { label: 'Strong', className: 'strong' };
}
