# rubocop:disable Style/StringLiterals
Vagrant.configure("2") do |config|
  config.vm.define "services" do |services|
    services.vm.box = "eropple/my-sidecar"
    services.vm.box_version = "~> 1.1"

    services.vm.hostname = "oss.dev.bot"
    services.vm.network "private_network", ip: "192.168.62.100"

    services.vm.provider "virtualbox" do |vb|
      vb.memory = "768"
    end

    services.vm.synced_folder ".", "/vagrant", disabled: true
  end
end
# rubocop:enable Style/StringLiterals
