#!/bin/bash

# Recommended commands from Packer
sleep 30
sudo yum update -y

# Install svn
sudo yum install subversion -y

# Create base directory and have ec2-user own them
sudo mkdir -p /var/www/svn
sudo chown -R ec2-user:ec2-user /var/www
sudo chmod -R 755 /var/www/svn

# Modify SELinux Firewall to allow port 80 traffic
sudo firewall-cmd --permanent --zone=public --add-port=80/tcp
sudo firewall-cmd --reload 

# Install SVN Server components into Apache
sudo yum install httpd mod_dav_svn -y
sudo chown -R ec2-user:ec2-user /etc/httpd/
sudo chmod -R 755 /etc/httpd/

# Create our repository
svnadmin create /var/www/svn/svnrepos


# Modify the .conf file
cat <<EOT >> /etc/httpd/conf.modules.d/10-subversion.conf

<Location /svn>
DAV svn
SVNParentPath /var/www/svn
AuthType Basic
AuthName "SVN Repo”
AuthUserFile /etc/svnusers
Require valid-user
</Location>
EOT

# Restart Apache
sudo systemctl restart httpd

# Create our first users
sudo htpasswd -b -cm /etc/svnusers admin $initialPassword
export initialPassword=



cat <<EOT >> /var/www/svn/svnrepos/conf/svnserve.conf

anon-access = none

auth-access = write

password-db = passwd
EOT

# Needed because SE Linux is enabled
sudo chcon -R -t httpd_sys_content_t /var/www/svn/svnrepos

# Modifying permissions for apache
sudo chmod 755 httpd
sudo chown apache:apache /etc/svnusers
sudo chown -R apache:apache /etc/httpd
sudo chown -R apache:apache /var/www
sudo chown -R apache:apache /var/log/httpd

# Start httpd on boot
sudo systemctl enable httpd.service

svnserve -d