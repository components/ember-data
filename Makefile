VERSION=v0.14

default: data
	@cd $< && git checkout master -f && git pull && git checkout $(VERSION) && bundle install && rake dist
	@cp -f $</dist/ember-data.* .

data:
	@git clone https://github.com/emberjs/data.git $@

.PHONY: default
