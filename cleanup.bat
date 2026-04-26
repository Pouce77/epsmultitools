@echo off
cd /d "c:\Users\julie\Desktop\Sites\epsmultitools"
php bin/console app:cleanup-inactive-users --env=prod >> var/log/cleanup.log 2>&1
