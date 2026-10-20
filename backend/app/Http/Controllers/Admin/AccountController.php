<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\{JsonResponse, Request};

class AccountController extends Controller
{
    private function requireAdmin(Request $request): void
    {
        abort_if($request->user()->role !== 'admin', 403, 'Hanya admin yang dapat mengelola akun.');
    }

    public function index(Request $request): JsonResponse
    {
        $this->requireAdmin($request);
        return response()->json(
            User::whereIn('role', ['admin', 'staff'])
                ->orderByRaw("role = 'admin' DESC")
                ->orderBy('name')
                ->get(['id', 'name', 'email', 'role', 'permissions', 'two_factor_confirmed_at', 'created_at'])
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->requireAdmin($request);
        $data = $request->validate([
            'name'          => ['required', 'string', 'max:100'],
            'email'         => ['required', 'email', 'unique:users,email'],
            'password'      => ['required', 'string', 'min:8'],
            'role'          => ['required', 'in:admin,staff'],
            'permissions'   => ['nullable', 'array'],
            'permissions.*' => ['string'],
        ]);
        $data['password'] = bcrypt($data['password']);
        if ($data['role'] === 'admin') $data['permissions'] = null;

        return response()->json(User::create($data), 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $this->requireAdmin($request);
        $data = $request->validate([
            'name'          => ['sometimes', 'required', 'string', 'max:100'],
            'email'         => ['sometimes', 'required', 'email', 'unique:users,email,' . $user->id],
            'password'      => ['nullable', 'string', 'min:8'],
            'role'          => ['sometimes', 'required', 'in:admin,staff'],
            'permissions'   => ['nullable', 'array'],
            'permissions.*' => ['string'],
        ]);

        abort_if(
            $user->role === 'admin' && ($data['role'] ?? 'admin') !== 'admin'
                && User::where('role', 'admin')->count() <= 1,
            422,
            'Minimal harus ada 1 admin aktif.'
        );

        if (!empty($data['password'])) {
            $data['password'] = bcrypt($data['password']);
        } else {
            unset($data['password']);
        }

        if (($data['role'] ?? $user->role) === 'admin') $data['permissions'] = null;

        $user->update($data);
        return response()->json($user->fresh());
    }

    /** For a staff member who lost their phone: turn their 2FA off so they can log in and set it up again. */
    public function resetTwoFactor(Request $request, User $user): JsonResponse
    {
        $this->requireAdmin($request);

        $user->forceFill(['two_factor_secret' => null, 'two_factor_recovery_codes' => null, 'two_factor_confirmed_at' => null])->save();
        $user->tokens()->delete(); // sign them out everywhere

        return response()->json(['message' => "Verifikasi 2 langkah {$user->name} direset."]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->requireAdmin($request);
        abort_if($user->id === $request->user()->id, 422, 'Tidak dapat menghapus akun sendiri.');
        abort_if(
            $user->role === 'admin' && User::where('role', 'admin')->count() <= 1,
            422,
            'Minimal harus ada 1 admin aktif.'
        );
        $user->delete();
        return response()->json(['message' => 'Akun dihapus.']);
    }
}
