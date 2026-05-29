package org.qortium.home;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.IOException;

@CapacitorPlugin(name = "UpdateInstaller")
public class UpdateInstallerPlugin extends Plugin {

    private static final String UPDATE_DOWNLOADS_DIR = "app-updates";

    @PluginMethod
    public void installApk(PluginCall call) {
        String filePath = call.getString("filePath");

        if (filePath == null || filePath.trim().isEmpty()) {
            call.reject("Downloaded update path is required.");
            return;
        }

        File apkFile;

        try {
            apkFile = getSafeApkFile(filePath.trim());
        } catch (IllegalArgumentException | IOException exception) {
            call.reject(exception.getMessage());
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            openUnknownAppsSettings();
            call.reject("Allow Qortium Home to install unknown apps, then tap Install APK again.");
            return;
        }

        Uri apkUri = FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            apkFile
        );

        Intent installIntent = new Intent(Intent.ACTION_VIEW);
        installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        try {
            getContext().startActivity(installIntent);
        } catch (ActivityNotFoundException exception) {
            call.reject("No Android package installer is available.", exception);
            return;
        }

        JSObject result = new JSObject();
        result.put("opened", true);
        call.resolve(result);
    }

    private File getSafeApkFile(String filePath) throws IOException {
        File updateRoot = new File(getContext().getFilesDir(), UPDATE_DOWNLOADS_DIR).getCanonicalFile();
        Uri fileUri = Uri.parse(filePath);
        String scheme = fileUri.getScheme();
        String path = "file".equals(scheme) ? fileUri.getPath() : filePath;

        if (path == null || path.trim().isEmpty()) {
            throw new IllegalArgumentException("Downloaded update path is invalid.");
        }

        File apkFile = new File(path).getCanonicalFile();
        String apkPath = apkFile.getPath();
        String updateRootPath = updateRoot.getPath();

        if (!apkPath.equals(updateRootPath) && !apkPath.startsWith(updateRootPath + File.separator)) {
            throw new IllegalArgumentException("Downloaded update must be inside Qortium Home app data.");
        }

        if (!apkFile.getName().toLowerCase().endsWith(".apk")) {
            throw new IllegalArgumentException("Downloaded update must be an APK file.");
        }

        if (!apkFile.isFile()) {
            throw new IllegalArgumentException("Downloaded update file was not found.");
        }

        return apkFile;
    }

    private void openUnknownAppsSettings() {
        Intent settingsIntent = new Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:" + getContext().getPackageName())
        );
        settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        try {
            getContext().startActivity(settingsIntent);
        } catch (ActivityNotFoundException ignored) {
            Intent fallbackIntent = new Intent(Settings.ACTION_SECURITY_SETTINGS);
            fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(fallbackIntent);
        }
    }
}
